import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, getActiveWorkspaceForUser, getCurrentMemberId } from "@/lib/auth/session";
import { isPlatformAdmin as checkIsPlatformAdmin } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { ReminderWatcher } from "@/components/calendar/ReminderWatcher";
import { PresenceHeartbeat } from "@/components/presence/PresenceHeartbeat";
import { SupervisorModeBanner } from "@/components/platform/SupervisorModeBanner";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  // getActiveWorkspaceForUser also resolves a platform admin's "modo
  // supervisor" cookie (a workspace the user isn't really a member of — see
  // 0039_role_permissions_system.sql + session.ts) — doing the lookup here
  // instead of re-deriving membership by hand means supervisor mode works
  // for every route under (protected)/, not just the ones that happen to
  // call requireActiveWorkspace() themselves.
  const activeWorkspace = await getActiveWorkspaceForUser(user.id);

  if (!activeWorkspace) {
    redirect("/select-workspace");
  }

  const userName = (user.user_metadata?.full_name as string | undefined) ?? "";
  const memberId = activeWorkspace.isSupervising ? null : await getCurrentMemberId(activeWorkspace.workspaceId);
  const isPlatformAdmin = await checkIsPlatformAdmin();

  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("workspace_modules")
    .select("module_key")
    .eq("workspace_id", activeWorkspace.workspaceId)
    .eq("enabled", true);
  const enabledModules = (modules ?? []).map((m) => m.module_key as string);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-2">
      <Sidebar
        enabledModules={enabledModules}
        userName={userName}
        userEmail={user.email ?? ""}
        isPlatformAdmin={isPlatformAdmin}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeWorkspace.isSupervising && <SupervisorModeBanner workspaceName={activeWorkspace.name} />}
        <Navbar workspaceName={activeWorkspace.name} enabledModules={enabledModules} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
      </div>
      {!activeWorkspace.isSupervising && (
        <PresenceHeartbeat workspaceId={activeWorkspace.workspaceId} memberId={memberId} />
      )}
      <ReminderWatcher />
    </div>
  );
}
