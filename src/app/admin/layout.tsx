import { MainShell } from "@/components/main-shell";
import { requireUser } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireUser();
  return <MainShell profile={profile}>{children}</MainShell>;
}
