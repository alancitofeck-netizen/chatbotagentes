import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { requireUser, getUserWorkspaces } from "@/lib/auth/session";
import { getActiveWorkspaceCookie } from "@/lib/auth/workspace-cookie";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Navbar workspaceName={activeWorkspace.name} userName={userName} userEmail={user.email ?? ""} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
