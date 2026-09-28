import { SettingsForm } from "@/components/settings-form";
import { requireUser } from "@/lib/auth/server";

export default async function SettingsPage() { const { profile } = await requireUser(); return <div className="content-wrap list-page"><h2>ตั้งค่า</h2><p>จัดการข้อมูลโปรไฟล์และรหัสผ่านของคุณ</p><SettingsForm profile={profile} /></div>; }
