"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import type { Profile } from "@/types/database";

export function UsersList() { const router = useRouter(); const [users, setUsers] = useState<Profile[]>([]); const [me, setMe] = useState(""); const [error, setError] = useState(""); useEffect(() => { fetch("/api/conversations").then((r) => r.json()).then((data) => { setUsers(data.users ?? []); setMe(data.me?.id ?? ""); }).catch(() => setError("โหลดผู้ใช้ไม่สำเร็จ")); }, []); async function open(userId: string) { const response = await fetch("/api/conversations", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({otherUserId:userId}) }); const data = await response.json(); if (response.ok) router.push(`/chat/${data.conversationId}`); else setError(data.error ?? "เปิดแชทไม่สำเร็จ"); } return <>{error && <p className="form-error">{error}</p>}<div className="user-grid">{users.filter((user) => user.id !== me).map((user) => <button className="user-card" key={user.id} onClick={() => open(user.id)}><span className="avatar"><UserRound size={16} /></span><span><strong>{user.display_name}</strong><span>@{user.username}</span></span></button>)}</div></>; }
