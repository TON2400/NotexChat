"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { identityEmail } from "@/lib/auth/identity";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setLoading(true); setError(""); const supabase = createClient(); const { error } = await supabase.auth.signInWithPassword({ email: identityEmail(username.trim()), password }); if (error) setError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"); else router.replace("/chat"); setLoading(false); }
  return <main className="auth-page"><section className="auth-card"><div className="brand"><span className="brand-mark">N</span><span>Notex chat</span></div><h1>ยินดีต้อนรับกลับ</h1><p className="muted">เข้าสู่พื้นที่สนทนาส่วนตัวของคุณ</p><form onSubmit={submit}><div className="field"><label htmlFor="username">Username</label><input id="username" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required /></div><div className="field"><label htmlFor="password">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>{error && <p className="form-error">{error}</p>}<button className="primary-button full" disabled={loading}>{loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}</button></form><p className="auth-footer">ยังไม่มีบัญชี? <Link href="/register">สมัครสมาชิก</Link></p></section></main>;
}
