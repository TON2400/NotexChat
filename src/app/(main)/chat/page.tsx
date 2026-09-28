import { MessageSquare } from "lucide-react";

export default function ChatPage() {
  return <section className="empty-state"><div className="empty-state-inner"><MessageSquare size={38} color="#3157d5" /><h2>เลือกห้องสนทนา</h2><p className="muted">เริ่มคุยใน Global chat หรือเลือกผู้ใช้งานเพื่อเปิดข้อความส่วนตัว</p></div></section>;
}
