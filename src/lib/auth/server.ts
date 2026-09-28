import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export async function getCurrentProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase.rpc("get_current_profile");
  return { supabase, user, profile: profile as Profile | null };
}

export async function requireUser() {
  const result = await getCurrentProfile();
  if (!result.user || !result.profile) redirect("/login");
  return result as typeof result & { user: NonNullable<typeof result.user>; profile: Profile };
}

export async function requireAdmin() {
  const result = await requireUser();
  if (result.profile.role !== "admin") redirect("/chat");
  return result;
}
