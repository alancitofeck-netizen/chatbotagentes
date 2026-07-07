"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clearActiveWorkspaceCookie } from "@/lib/auth/workspace-cookie";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearActiveWorkspaceCookie();
  redirect("/login");
}
