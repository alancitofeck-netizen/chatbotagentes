import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, getUserWorkspaces } from "@/lib/auth/session";
import { getActiveWorkspaceCookie } from "@/lib/auth/workspace-cookie";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { ReminderWatcher } from "@/components/calendar/ReminderWatcher";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const workspaces = await getUserWorkspaces(user.id);

  if (workspaces.length === 0) {
    redirect("/select-workspace");
  }

  const activeWorkspaceId = await getActiveWorkspaceCookie();
  const activeWorkspace = workspaces.find((w) => w.workspaceId === activeWorkspaceId);

  if (!activeWorkspace) {
    redirect("/select-workspace");
  }

  const userName = (user.user_metadata?.full_name as string | undefined) ?? "";

  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("workspace_modules")
    .select("module_key")
    .eq("workspace_id", activeWorkspace.workspaceId)
    .eq("enabled", true);
  const enabledModules = (modules ?? []).map((m) => m.module_key as string);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-2">
      <Sidebar enabledModules={enabledModules} userName={userName} userEmail={user.email ?? ""} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar workspaceName={activeWorkspace.name} enabledModules={enabledModules} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
      <ReminderWatcher />
    </div>
  );
}
