import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getMiniAppsList } from "@/lib/miniApps/queries";
import { MiniAppsListShell } from "./MiniAppsListShell";

export const metadata: Metadata = {
  title: "Mini Apps — Growth Link",
};

export default async function MiniAppsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  const enabled = moduleStatus.some((m) => m.moduleKey === "mini_apps" && m.enabled);

  const [miniApps, members] = enabled
    ? await Promise.all([getMiniAppsList(workspaceId), getWorkspaceMembers(workspaceId)])
    : [[], []];

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Mini Apps</h1>
        <p className="text-sm text-neutral-500">Simuladores y formularios públicos que capturan leads para el CRM.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <MiniAppsListShell initialMiniApps={miniApps} members={members} moduleEnabled={enabled} />
      </div>
    </div>
  );
}
