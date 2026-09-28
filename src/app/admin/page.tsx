import { AdminDashboard } from "@/components/admin-dashboard";
import { requireAdmin } from "@/lib/auth/server";

export default async function AdminPage() { await requireAdmin(); return <div className="content-wrap list-page"><h2>Admin dashboard</h2><p>จัดการผู้ใช้และ invite keys ของระบบ</p><AdminDashboard /></div>; }
