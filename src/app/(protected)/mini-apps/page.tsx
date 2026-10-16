import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getMiniAppsList, getMiniAppsListResumen } from "@/lib/miniApps/queries";
import { MiniAppsListShell } from "./MiniAppsListShell";

export const metadata: Metadata = {
  title: "Mini Apps — Growth Link",
};

export default async function MiniAppsPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const canManage = role === "owner" || role === "admin";
  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  const enabled = moduleStatus.some((m) => m.moduleKey === "mini_apps" && m.enabled);

  const [miniApps, members, resumen] = enabled
    ? await Promise.all([getMiniAppsList(workspaceId), getWorkspaceMembers(workspaceId), getMiniAppsListResumen(workspaceId)])
    : [[], [], null];

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <MiniAppsListShell initialMiniApps={miniApps} members={members} moduleEnabled={enabled} canManage={canManage} initialResumen={resumen} />
      </div>
    </div>
  );
}
