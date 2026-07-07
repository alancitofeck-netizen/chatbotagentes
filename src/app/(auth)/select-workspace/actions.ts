"use server";

import { redirect } from "next/navigation";
import { requireUser, isWorkspaceMember } from "@/lib/auth/session";
import { setActiveWorkspaceCookie } from "@/lib/auth/workspace-cookie";

export async function selectWorkspace(formData: FormData) {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");

  const belongs = await isWorkspaceMember(user.id, workspaceId);
  if (!belongs) redirect("/access-denied");

  await setActiveWorkspaceCookie(workspaceId);
  redirect("/dashboard");
}
