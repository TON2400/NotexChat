"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { identityEmail } from "@/lib/auth/identity";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [inviteKey, setInviteKey] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); const response = await fetch("/api/register", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ username, password, inviteKey }) }); const result = await response.json(); if (!response.ok) { setError(result.error ?? "สมัครสมาชิกไม่สำเร็จ"); setLoading(false); return; } const supabase = createClient(); const { error: loginError } = await supabase.auth.signInWithPassword({ email: identityEmail(username.trim()), password }); if (loginError) setError("สร้างบัญชีแล้ว แต่เข้าสู่ระบบไม่สำเร็จ"); else router.replace("/chat"); setLoading(false); }
  return <main className="auth-page"><section className="auth-card"><div className="brand"><span className="brand-mark">N</span><span>Notex chat</span></div><h1>สร้างบัญชี</h1><p className="muted">ใช้ invite key เพื่อเข้าร่วมแชทส่วนตัว</p><form onSubmit={submit}><div className="field"><label htmlFor="username">Username</label><input id="username" autoComplete="username" minLength={3} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value)} required /></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div><div className="field"><label htmlFor="invite">Invite key</label><input id="invite" value={inviteKey} onChange={(e) => setInviteKey(e.target.value)} required /></div>{error && <p className="form-error">{error}</p>}<button className="primary-button full" disabled={loading}>{loading ? "กำลังสร้างบัญชี..." : "สมัครสมาชิก"}</button></form><p className="auth-footer">มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link></p></section></main>;
}
