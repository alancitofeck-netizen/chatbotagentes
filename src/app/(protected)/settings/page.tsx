import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembersList, getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { SettingsShell } from "./SettingsShell";

export const metadata: Metadata = {
  title: "Configuración — Growth Link",
};

export default async function SettingsPage() {
  const { workspaceId, role } = await requireActiveWorkspace();

  const [modules, members] = await Promise.all([
    getWorkspaceModuleStatus(workspaceId),
    getWorkspaceMembersList(workspaceId),
  ]);

  return <SettingsShell initialModules={modules} initialMembers={members} currentRole={role} />;
}
