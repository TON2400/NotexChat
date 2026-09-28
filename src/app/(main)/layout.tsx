import { requireUser } from "@/lib/auth/server";
import { MainShell } from "@/components/main-shell";

export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireUser();
  return <MainShell profile={profile}>{children}</MainShell>;
}
