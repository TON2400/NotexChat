"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Settings, Shield, Users, X } from "lucide-react";
import type { Profile } from "@/types/database";
import type { ConversationSummary } from "@/types/chat";

type Props = { profile: Profile; children: React.ReactNode };

export function MainShell({ profile, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [globalId, setGlobalId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch("/api/conversations").then((response) => response.ok ? response.json() : null).then((data) => {
      if (data) { setConversations(data.conversations ?? []); setGlobalId(data.global?.id ?? null); }
    });
  }, [pathname]);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
  const closeMobile = () => setMobileOpen(false);
  const initial = (profile.display_name || profile.username).slice(0, 1).toUpperCase();

  return <div className="app-shell">
    <button aria-label="ปิดเมนู" className={`sidebar-backdrop ${mobileOpen ? "visible" : ""}`} onClick={closeMobile} />
    <aside className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-header"><Link href="/chat" className="brand" onClick={closeMobile}><span className="brand-mark">N</span><span>Notex chat</span></Link><button aria-label="ปิดเมนู" className="sidebar-close mobile-only" onClick={closeMobile}><X size={18} /></button></div>
      <div className="sidebar-section"><div className="section-label"><span>Chats</span></div>
        {globalId && <Link href={`/chat/${globalId}`} onClick={closeMobile} className={`conversation-link ${pathname === `/chat/${globalId}` ? "active" : ""}`}><span className="conversation-avatar">#</span><span className="conversation-title">Global chat</span></Link>}
        {conversations.map((conversation) => <Link key={conversation.id} href={`/chat/${conversation.id}`} onClick={closeMobile} className={`conversation-link ${pathname === `/chat/${conversation.id}` ? "active" : ""}`}><span className="conversation-avatar">{(conversation.otherUser?.display_name || conversation.otherUser?.username || "?").slice(0, 1).toUpperCase()}</span><span className="conversation-title">{conversation.otherUser?.display_name || conversation.otherUser?.username || "Direct chat"}</span></Link>)}
      </div>
      <div className="sidebar-bottom"><div className="user-row"><span className="avatar">{initial}</span><span className="user-meta"><strong>{profile.display_name}</strong><span>@{profile.username}</span></span></div><Link href="/users" onClick={closeMobile} className="nav-link"><Users size={16} /> ผู้ใช้งาน</Link><Link href="/settings" onClick={closeMobile} className="nav-link"><Settings size={16} /> ตั้งค่า</Link>{profile.role === "admin" && <Link href="/admin" onClick={closeMobile} className="nav-link"><Shield size={16} /> Admin</Link>}<button onClick={logout} className="nav-link" style={{ border: 0, background: "transparent", width: "100%", textAlign: "left" }}>ออกจากระบบ</button></div>
    </aside>
    <main className="main-content"><div className="topbar"><button aria-label="เปิดเมนู" className="mobile-menu-button mobile-only" onClick={() => setMobileOpen(true)}><Menu size={19} /></button><h1>{pathname.startsWith("/admin") ? "Admin dashboard" : pathname.startsWith("/settings") ? "ตั้งค่า" : pathname.startsWith("/users") ? "ผู้ใช้งาน" : "ข้อความ"}</h1><span className="mobile-only muted" style={{ fontSize: 12 }}>Notex chat</span></div>{children}</main>
  </div>;
}
