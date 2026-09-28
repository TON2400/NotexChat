import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user } = await getCurrentProfile();
  redirect(user ? "/chat" : "/login");
}
